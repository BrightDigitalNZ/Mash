// Minimal Deno globals so the functions can be type-checked with tsc (npm run typecheck:functions).
// Supabase's Deno runtime provides the real ones.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: { get(key: string): string | undefined };
}
