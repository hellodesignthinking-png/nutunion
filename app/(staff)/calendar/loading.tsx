export default function StaffCalendarLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
      <div className="h-8 w-32 bg-nu-ink/8 animate-pulse mb-8" />
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white border border-nu-ink/[0.06] animate-pulse mb-3" />)}
    </div>
  );
}
