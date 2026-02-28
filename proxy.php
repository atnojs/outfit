<?php
// proxy.php

// 1. Establecer el tipo de contenido de la respuesta a JSON.
header('Content-Type: application/json');

// 2. Obtener la clave de API desde una variable de entorno por seguridad.
// En Hostinger, puedes configurar esto en tu archivo .htaccess o a través de su hPanel.
 $apiKey = getenv('B');

// Si la clave de API no está configurada, devuelve un error.
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'La clave de API no está configurada en el servidor.']);
    exit();
}

// 3. Obtener los datos POST enviados desde el JavaScript.
 $requestBody = file_get_contents('php://input');
 $data = json_decode($requestBody, true);

// Validar que los datos recibidos son correctos.
if (json_last_error() !== JSON_ERROR_NONE || !isset($data['targetUrl']) || !isset($data['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos de la solicitud no válidos.', 'data' => $data]);
    exit();
}

 $targetUrl = $data['targetUrl'];
 $payload = $data['payload'];

// 4. Construir la URL final de la API de Google con la clave.
 $finalApiUrl = $targetUrl . '?key=' . $apiKey;

// 5. Usar cURL para reenviar la solicitud a la API de Google.
 $ch = curl_init();

curl_setopt($ch, CURLOPT_URL, $finalApiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_VERBOSE, true);
 $verbose = fopen('php://temp', 'w+');
curl_setopt($ch, CURLOPT_STDERR, $verbose);

// 6. Ejecutar la solicitud y obtener la respuesta y el código de estado.
 $response = curl_exec($ch);
 $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// Manejar errores de cURL.
if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de cURL: ' . curl_error($ch)]);
    curl_close($ch);
    exit();
}

// Obtener información de depuración
rewind($verbose);
 $verboseLog = stream_get_contents($verbose);
curl_close($ch);

// 7. Reenviar el código de estado y la respuesta de Google de vuelta al cliente.
http_response_code($httpcode);

// Si hay un error, incluir información de depuración
if ($httpcode >= 400) {
    echo json_encode([
        'error' => 'Error en la API de Google',
        'status' => $httpcode,
        'response' => json_decode($response),
        'request' => $payload,
        'url' => $finalApiUrl,
        'verbose' => $verboseLog
    ]);
} else {
    echo $response;
}
?>