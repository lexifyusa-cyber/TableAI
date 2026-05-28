import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-6xl font-bold text-gradient">404</div>
      <h1 className="mt-2 text-xl font-semibold text-ink-900 dark:text-ink-100">Page not found</h1>
      <p className="mt-1 text-sm text-ink-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
