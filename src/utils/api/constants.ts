// Base URL of the PHP proxy directory (the folder holding getCatalog.php and
// getFile.php), with a trailing slash. Set VITE_API_BASE to point at a local
// `npm run serve-php` (http://localhost:8000/); defaults to the hosted proxy.
export const API_BASE: string =
  import.meta.env.VITE_API_BASE || 'https://tiptoi-manager.nico.dev/api/';
