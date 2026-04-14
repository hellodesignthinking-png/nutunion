export default function StaffTasksLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
      <div className="h-8 w-24 bg-nu-ink/8 animate-pulse mb-8" />
      {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white border border-nu-ink/[0.06] animate-pulse mb-2" />)}
    </div>
  );
}
