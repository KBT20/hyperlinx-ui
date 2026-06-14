export default function DALPlaceholderWorkspace({ title }: { title: string }) {
  return (
    <section className="dal-workspace">
      <div className="dal-panel">
        <h2>{title}</h2>
        <p>
          {title} is mounted inside the DAL development shell as an isolated workspace. Production components are not imported
          here until their API dependencies can be pointed safely at DAL services.
        </p>
      </div>
    </section>
  );
}
