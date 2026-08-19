const MAX_JSON_BYTES = 120_000;

export function rejectUnsafeMutation(request: Request, maxBytes = MAX_JSON_BYTES) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  if (request.headers.get("x-dct-csrf") !== "1") {
    return Response.json({ error: "Request verification failed." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json({ error: "JSON requests are required." }, { status: 415 });
  }
  return null;
}
