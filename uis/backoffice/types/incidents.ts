export interface IncidentTotals {
  processed: number;
  valid: number;
  invalid: number;
}

export interface IncidentAnalysisResult {
  totals: IncidentTotals;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  satisfaction: {
    closed_with_score: number;
    closed_valid_records: number;
    average_closed: number | null;
    distribution: Record<string, number>;
  };
  invalid: {
    by_type: Record<string, number>;
    records: Array<{
      row_number: number;
      primary_error_type: string;
      errors: Array<{
        row_number: number;
        error_type: string;
        field: string;
        value: string;
        message: string;
      }>;
    }>;
  };
  export_rows: Array<{
    section: string;
    metric: string;
    value: string;
  }>;
}
