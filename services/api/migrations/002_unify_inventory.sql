-- Run manually on the academic demo only. Copies and validates before DROP.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE inventory_item, inventory_lot, inventory_movement IN ACCESS EXCLUSIVE MODE;

ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS sku VARCHAR;
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS source_asset_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_item_sku ON inventory_item(sku);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_item_source_asset ON inventory_item(source_asset_id);
ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS ck_inventory_item_category;
ALTER TABLE inventory_item ADD CONSTRAINT ck_inventory_item_category CHECK (
  category IN ('it_equipment', 'office_supplies', 'training_materials',
               'branded_merchandise', 'hardware', 'peripherals')
);
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS supplier VARCHAR;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS exit_type VARCHAR;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS assigned_to VARCHAR;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS office VARCHAR;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS user_uuid VARCHAR;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS source_order_id INTEGER;

DO $$
DECLARE
  missing_tables INTEGER;
BEGIN
  SELECT count(*) INTO missing_tables FROM (
    VALUES (to_regclass('asset')), (to_regclass('assetentry')), (to_regclass('assetexit'))
  ) AS t(tab) WHERE tab IS NULL;
  IF missing_tables = 3 THEN
    RAISE NOTICE 'Legacy tables absent: unified schema already installed.';
    RETURN;
  ELSIF missing_tables <> 0 THEN
    RAISE EXCEPTION 'Incomplete legacy inventory: aborting without dropping tables.';
  END IF;

  EXECUTE 'LOCK TABLE asset, assetentry, assetexit IN ACCESS EXCLUSIVE MODE';
  IF EXISTS (SELECT 1 FROM inventory_item WHERE source_asset_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM inventory_movement WHERE source_order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Partial import detected: inspect before retrying.';
  END IF;
  IF EXISTS (SELECT 1 FROM asset WHERE office NOT IN ('Valencia','Miami')
      OR category NOT IN ('hardware','peripherals','office_supplies','training_materials')
      OR sku IS NULL OR btrim(sku) = '') THEN
    RAISE EXCEPTION 'Unsupported legacy asset values.';
  END IF;
  IF EXISTS (SELECT 1 FROM assetentry e LEFT JOIN asset a ON a.id=e.asset_id
      WHERE a.id IS NULL OR e.quantity <= 0 OR e.office NOT IN ('Valencia','Miami'))
     OR EXISTS (SELECT 1 FROM assetexit e LEFT JOIN asset a ON a.id=e.asset_id
      WHERE a.id IS NULL OR e.quantity <= 0 OR e.office NOT IN ('Valencia','Miami')
        OR e.exit_type NOT IN ('allocation','consumption')
        OR (e.exit_type='allocation' AND (e.assigned_to IS NULL OR btrim(e.assigned_to)=''))
        OR (e.exit_type='consumption' AND e.assigned_to IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid legacy orders or references.';
  END IF;

  -- Names are not identifiers: each old asset becomes a separate article.
  INSERT INTO inventory_item (office,name,sku,category,unit_of_measure,reorder_point,
      lot_tracked,created_at,updated_at,source_asset_id)
  SELECT lower(office),name,sku,category,'unit',0,false,now(),now(),id
  FROM asset ORDER BY id;

  INSERT INTO inventory_movement (item_id,lot_id,movement_type,quantity,reason,
      supplier,office,user_uuid,source_order_id,created_at)
  SELECT i.id,NULL,'inbound',e.quantity,NULL,e.supplier,lower(e.office),
      e.user_uuid,e.id,e.created_at
  FROM assetentry e JOIN inventory_item i ON i.source_asset_id=e.asset_id;
  INSERT INTO inventory_movement (item_id,lot_id,movement_type,quantity,reason,
      exit_type,assigned_to,office,user_uuid,source_order_id,created_at)
  SELECT i.id,NULL,'outbound',e.quantity,NULL,e.exit_type,e.assigned_to,
      lower(e.office),e.user_uuid,e.id,e.created_at
  FROM assetexit e JOIN inventory_item i ON i.source_asset_id=e.asset_id;

  IF (SELECT count(*) FROM asset) <> (SELECT count(*) FROM inventory_item WHERE source_asset_id IS NOT NULL)
     OR (SELECT count(*) FROM assetentry) <> (SELECT count(*) FROM inventory_movement WHERE source_order_id IS NOT NULL AND movement_type='inbound')
     OR (SELECT count(*) FROM assetexit) <> (SELECT count(*) FROM inventory_movement WHERE source_order_id IS NOT NULL AND movement_type='outbound') THEN
    RAISE EXCEPTION 'Import count mismatch.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM asset a JOIN inventory_item i ON i.source_asset_id=a.id
    WHERE (i.name,i.sku,i.category,i.office) IS DISTINCT FROM (a.name,a.sku,a.category,lower(a.office))
  ) OR EXISTS (
    SELECT 1 FROM assetentry e JOIN inventory_item i ON i.source_asset_id=e.asset_id
    LEFT JOIN inventory_movement m ON m.item_id=i.id AND m.source_order_id=e.id AND m.movement_type='inbound'
    WHERE m.id IS NULL OR (m.quantity,m.supplier,m.office,m.user_uuid,m.created_at)
      IS DISTINCT FROM (e.quantity::numeric,e.supplier,lower(e.office),e.user_uuid,e.created_at::timestamptz)
  ) OR EXISTS (
    SELECT 1 FROM assetexit e JOIN inventory_item i ON i.source_asset_id=e.asset_id
    LEFT JOIN inventory_movement m ON m.item_id=i.id AND m.source_order_id=e.id AND m.movement_type='outbound'
    WHERE m.id IS NULL OR (m.quantity,m.exit_type,m.assigned_to,m.office,m.user_uuid,m.created_at)
      IS DISTINCT FROM (e.quantity::numeric,e.exit_type,e.assigned_to,lower(e.office),e.user_uuid,e.created_at::timestamptz)
  ) THEN
    RAISE EXCEPTION 'Import field mismatch.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM asset a JOIN inventory_item i ON i.source_asset_id=a.id
    WHERE
      coalesce((SELECT sum(quantity) FROM assetentry WHERE asset_id=a.id),0)
        - coalesce((SELECT sum(quantity) FROM assetexit WHERE asset_id=a.id),0)
      <> coalesce((SELECT sum(CASE WHEN movement_type='outbound' THEN -quantity ELSE quantity END)
          FROM inventory_movement WHERE item_id=i.id),0)
  ) THEN
    RAISE EXCEPTION 'Import stock mismatch.';
  END IF;

  DROP TABLE assetexit;
  DROP TABLE assetentry;
  DROP TABLE asset;
END $$;

UPDATE inventory_item SET sku='NXV-ITEM-' || id WHERE sku IS NULL;
COMMIT;

-- Unified rows, including traceable old IDs:
SELECT id, source_asset_id, sku, name, office FROM inventory_item ORDER BY id;
