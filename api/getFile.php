<?php
// URL of the .gme file you want to fetch
$url = $_GET['url'] ?? '';
// The catalog used to serve files from cdn.ravensburger.cloud; it now points at
// ravensburger.cloud directly, so accept both.
$valid_url_regex = '/^https:\/\/(cdn\.)?ravensburger\.cloud\//';
$allowedOrigins = [
    'https://localhost:4541',
    'https://tiptoi-manager.nico.dev',
];

if (!$url) {
    http_response_code(400);
    die('ERROR: url not specified');
} elseif (!preg_match($valid_url_regex, $url)) {
    http_response_code(400);
    die('ERROR: invalid url');
}

// Define the filename for the downloaded file
$fileName = basename($url);

// ravensburger.cloud answers 403 to requests without a User-Agent, which is
// what file_get_contents sends by default.
$context = stream_context_create([
    'http' => ['header' => "User-Agent: Mozilla/5.0 (tiptoi-manager)\r\n"],
]);

// Stream the .gme file from the remote server (they run to 60MB+)
$remote = fopen($url, 'rb', false, $context);

if ($remote === false) {
    // Failed to fetch the file, handle the error
    http_response_code(502);
    die('Failed to fetch the .gme file.');
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET');
    header('Access-Control-Allow-Headers: Content-Type');
}

// Set the appropriate HTTP headers to indicate a file download
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"');

// Output the file contents
fpassthru($remote);
fclose($remote);
