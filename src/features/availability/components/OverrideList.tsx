import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TimeSelect } from "./TimeSelect";
import type { DateOverride } from "../api/availability";

interface Props {
  overrides: DateOverride[];
  onAdd: (input: Omit<DateOverride, "id" | "mentor_id">) => void;
  onRemove: (id: string) => void;
}

export function OverrideList({ overrides, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [unavailable, setUnavailable] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const submit = () => {
    if (!date) return;
    onAdd({
      date,
      is_unavailable: unavailable,
      start_time: unavailable ? null : start,
      end_time: unavailable ? null : end,
    });
    setAdding(false);
    setDate("");
    setUnavailable(true);
    setStart("09:00");
    setEnd("17:00");
  };

  return (
    <div className="space-y-3">
      {overrides.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No date overrides yet.</p>
      )}

      {overrides.map((o) => (
        <div
          key={o.id}
          className="flex items-center justify-between rounded-lg border p-3 bg-card"
        >
          <div>
            <p className="font-medium text-sm">
              {format(parseISO(o.date), "EEE, MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">
              {o.is_unavailable
                ? "Unavailable"
                : `${o.start_time?.slice(0, 5)} – ${o.end_time?.slice(0, 5)}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onRemove(o.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      {adding ? (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!unavailable} onCheckedChange={(v) => setUnavailable(!v)} />
              <span className="text-sm">
                {unavailable ? "Mark as unavailable" : "Set custom hours"}
              </span>
            </div>
            {!unavailable && (
              <div className="flex items-center gap-2">
                <TimeSelect value={start} onChange={setStart} />
                <span className="text-muted-foreground">–</span>
                <TimeSelect value={end} onChange={setEnd} />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!date}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add date override
        </Button>
      )}
    </div>
  );
}
