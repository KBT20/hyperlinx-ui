export default function Surface({ children }: { children: any }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 12,
        padding: 20,
        width: "100%",
        height: "100%",
        minHeight: "calc(100vh - 160px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}