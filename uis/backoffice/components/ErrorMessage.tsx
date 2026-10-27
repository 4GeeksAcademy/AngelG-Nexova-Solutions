interface ErrorMessageProps {
  title?: string;
  message: string;
}

export function ErrorMessage({
  title = "Ha ocurrido un error",
  message,
}: ErrorMessageProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
      <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      <p className="mt-1 text-sm leading-6">{message}</p>
    </div>
  );
}
