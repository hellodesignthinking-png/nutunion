import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Calendar, MapPin, Clock, Users, Repeat } from "lucide-react";
import { EventActions } from "@/components/schedule/event-actions";
import { GoogleCalendarButton } from "@/components/integrations/google-calendar-button";
import { KakaoShareButton } from "@/components/integrations/kakao-share-button";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id: groupId, eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("*, creator:profiles!events_created_by_fkey(nickname)")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("*, profile:profiles(*)")
    .eq("event_id", eventId)
    .order("registered_at");

  const registered = attendees?.filter((a) => a.status === "registered") || [];
  const waitlisted = attendees?.filter((a) => a.status === "waitlist") || [];
  const myAttendance = attendees?.find((a) => a.user_id === user.id);

  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Event header */}
      <div className="mb-8">
        {event.is_recurring && (
          <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-3">
            <Repeat size={12} /> 반복 일정
          </span>
        )}
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">
          {event.title}
        </h1>
        {event.description && (
          <p className="text-nu-gray mt-3 max-w-2xl leading-relaxed">
            {event.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Details */}
        <div className="lg:col-span-2">
          <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-nu-pink shrink-0" />
                <div>
                  <p className="font-medium">
                    {startDate.toLocaleDateString("ko", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-nu-blue shrink-0" />
                <p>
                  {startDate.toLocaleTimeString("ko", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ~{" "}
                  {endDate.toLocaleTimeString("ko", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {event.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-nu-amber shrink-0" />
                  <p>{event.location}</p>
                </div>
              )}
              {event.max_attendees && (
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-nu-ink shrink-0" />
                  <p>
                    최대 {event.max_attendees}명 (현재 {registered.length}명 참석)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <EventActions
            eventId={eventId}
            userId={user.id}
            myStatus={myAttendance?.status || null}
            maxAttendees={event.max_attendees}
            registeredCount={registered.length}
          />

          {/* Integration buttons */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mt-4 flex flex-wrap gap-3">
            <GoogleCalendarButton
              title={event.title}
              description={event.description || ""}
              location={event.location || ""}
              startAt={event.start_at}
              endAt={event.end_at}
            />
            <KakaoShareButton
              title={event.title}
              description={`${startDate.toLocaleDateString("ko")} - ${event.location || "nutunion"}`}
              url={`https://nutunion.co.kr/groups/${groupId}/events/${eventId}`}
            />
          </div>
        </div>

        {/* Attendees sidebar */}
        <div>
          <h2 className="font-head text-lg font-extrabold mb-4">
            참석자 ({registered.length})
          </h2>
          <div className="bg-nu-white border border-nu-ink/[0.08] p-4 mb-4">
            {registered.length === 0 ? (
              <p className="text-sm text-nu-muted text-center py-4">
                아직 참석자가 없습니다
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {registered.map((a: any) => (
                  <div key={a.user_id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold">
                      {(a.profile?.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{a.profile?.nickname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {waitlisted.length > 0 && (
            <>
              <h2 className="font-head text-lg font-extrabold mb-4">
                대기자 ({waitlisted.length})
              </h2>
              <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
                <div className="flex flex-col gap-2.5">
                  {waitlisted.map((a: any) => (
                    <div key={a.user_id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-nu-yellow/20 flex items-center justify-center font-head text-[10px] font-bold">
                        {(a.profile?.nickname || "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-nu-muted">
                        {a.profile?.nickname}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="font-mono-nu text-[10px] text-nu-muted mt-4">
            주최: {event.creator?.nickname}
          </p>
        </div>
      </div>
    </div>
  );
}
