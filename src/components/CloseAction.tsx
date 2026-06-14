export default function CloseAction({
  submitClose
}: {
  submitClose: () => void
}) {

  return (
    <div style={{ marginTop: "10px" }}>
      <button onClick={submitClose}>
        Submit Close
      </button>
    </div>
  )
}