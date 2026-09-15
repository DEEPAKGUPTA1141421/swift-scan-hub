import { CheckCircle2, MapPin, Truck, User } from 'lucide-react';
import type { JourneyTimelineEntry } from '@/services/api';

function eventLabel(entry: JourneyTimelineEntry): string {
  if (entry.source === 'LEG') {
    return entry.legType ? entry.legType.replace(/_/g, ' ') : 'Shipment leg';
  }
  return entry.eventType ? entry.eventType.replace(/_/g, ' ') : 'Event';
}

interface TrackingTimelineProps {
  timeline: JourneyTimelineEntry[];
}

export function TrackingTimeline({ timeline }: TrackingTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8 border border-dashed rounded-xl">
        No events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-7">
      <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-5">
        {timeline.map((entry, i) => (
          <div key={i} className="relative flex gap-4">
            <div className="absolute -left-7 w-5 h-5 rounded-full border-2 bg-success border-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 pb-1">
              <p className="font-medium text-sm capitalize">{eventLabel(entry)}</p>
              {entry.locationName && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" /> {entry.locationName}
                </p>
              )}
              {(entry.actorName || entry.actorType) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  {entry.actorName ?? entry.actorType}
                  {entry.actorPhoneMasked && ` · ${entry.actorPhoneMasked}`}
                </p>
              )}
              {(entry.vehicleNumber || entry.transportMode) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Truck className="w-3 h-3 shrink-0" />
                  {[entry.vehicleNumber, entry.transportMode].filter(Boolean).join(' · ')}
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>
              )}
              {entry.occurredAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(entry.occurredAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
