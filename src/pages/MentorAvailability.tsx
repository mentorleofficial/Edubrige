import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
}

const MentorAvailability = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const fetchSlots = async () => {
    if (!user) return;
    const { data } = await supabase.from("mentor_availability")
      .select("*").eq("mentor_id", user.id).order("day_of_week");
    setSlots(data || []);
  };

  useEffect(() => { fetchSlots(); }, [user]);

  const addSlot = async () => {
    if (!user) return;
    const { error } = await supabase.from("mentor_availability").insert({
      mentor_id: user.id,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
    });
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else { toast({ title: "Slot added" }); fetchSlots(); }
  };

  const deleteSlot = async (id: string) => {
    await supabase.from("mentor_availability").delete().eq("id", id);
    fetchSlots();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Availability</h1>
        <Card>
          <CardHeader><CardTitle>Add Time Slot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={addSlot}><Plus className="mr-2 h-4 w-4" />Add Slot</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Current Availability</CardTitle></CardHeader>
          <CardContent>
            {slots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No availability set.</p>
            ) : (
              <div className="space-y-2">
                {slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{DAYS[s.day_of_week]}</Badge>
                      <span className="text-sm">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteSlot(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorAvailability;
