export function TranscriptPanel({
  transcript,
  response,
}: {
  transcript?: string | null;
  response: string;
}) {
  return (
    <div className="transcript-panel">
      {transcript ? <p className="transcript">“{transcript}”</p> : null}
      {transcript ? <div className="response-rule" aria-hidden="true" /> : null}
      <p className="response">{response}</p>
    </div>
  );
}
