import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <h1 className="text-6xl font-extrabold text-primary">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Oops! The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="mt-6 bg-primary text-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary transition"
      >
        Go Back Home
      </Link>
    </div>
  );
}
