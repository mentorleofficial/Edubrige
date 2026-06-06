import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Briefcase, Plus, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceValue } from "../schema";

interface Props {
  value: ExperienceValue[];
  onChange: (v: ExperienceValue[]) => void;
}

const empty: ExperienceValue = {
  company: "",
  title: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
};

const formatRange = (e: ExperienceValue) => {
  const fmt = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return "";
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };
  return `${fmt(e.start_date) || "—"} → ${e.end_date ? fmt(e.end_date) : "Present"}`;
};

interface MonthYearPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MonthYearPicker = ({ value, onChange, placeholder = "Select date", disabled }: MonthYearPickerProps) => {
  const [open, setOpen] = useState(false);

  // Parse current value or fallback to current date
  const initialDate = value ? new Date(value + "-02") : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  // Keep currentYear in sync when value changes or popover opens
  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      const y = parseInt(parts[0], 10);
      if (!isNaN(y)) {
        setCurrentYear(y);
      }
    }
  }, [value, open]);

  const months = [
    { label: "Jan", value: 0 },
    { label: "Feb", value: 1 },
    { label: "Mar", value: 2 },
    { label: "Apr", value: 3 },
    { label: "May", value: 4 },
    { label: "Jun", value: 5 },
    { label: "Jul", value: 6 },
    { label: "Aug", value: 7 },
    { label: "Sep", value: 8 },
    { label: "Oct", value: 9 },
    { label: "Nov", value: 10 },
    { label: "Dec", value: 11 },
  ];

  const formatValue = (val: string) => {
    if (!val) return placeholder;
    const parts = val.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return placeholder;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };

  const handleSelectMonth = (monthIndex: number) => {
    const formattedMonth = String(monthIndex + 1).padStart(2, "0");
    onChange(`${currentYear}-${formattedMonth}`);
    setOpen(false);
  };

  const isFuture = (monthIndex: number) => {
    const today = new Date();
    const target = new Date(currentYear, monthIndex, 1);
    return target > today;
  };

  const isSelected = (monthIndex: number) => {
    if (!value) return false;
    const parts = value.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return y === currentYear && m === monthIndex + 1;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full pl-3 pr-3 text-left font-normal h-10 flex items-center justify-between border-input bg-background",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
          type="button"
        >
          {value ? formatValue(value) : <span>{placeholder}</span>}
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentYear((y) => y - 1)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">{currentYear}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentYear((y) => y + 1)}
              disabled={currentYear >= new Date().getFullYear()}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {months.map((m) => {
              const selected = isSelected(m.value);
              const disabledMonth = isFuture(m.value);
              return (
                <Button
                  key={m.value}
                  variant={selected ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 w-full text-xs font-normal",
                    selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                  disabled={disabledMonth}
                  onClick={() => handleSelectMonth(m.value)}
                  type="button"
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ExperienceList = ({ value, onChange }: Props) => {
  const update = (i: number, patch: Partial<ExperienceValue>) => {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { ...empty }]);

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">No experience added yet</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Add your first role
          </Button>
        </div>
      )}

      {value.map((exp, i) => {
        const isPresent = !exp.end_date;
        return (
          <div key={i} className="relative rounded-lg border bg-card p-5 space-y-4">
            <div className="absolute right-3 top-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title *</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Senior Product Manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company *</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => update(i, { company: e.target.value })}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={exp.location || ""}
                    onChange={(e) => update(i, { location: e.target.value })}
                    placeholder="San Francisco, CA · Remote"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start *</Label>
                  <MonthYearPicker
                    value={exp.start_date}
                    onChange={(val) => update(i, { start_date: val })}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End</Label>
                  <MonthYearPicker
                    value={exp.end_date || ""}
                    disabled={isPresent}
                    onChange={(val) => update(i, { end_date: val })}
                    placeholder="Select end date"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1">
                    <Checkbox
                      checked={isPresent}
                      onCheckedChange={(c) => update(i, { end_date: c ? "" : exp.start_date })}
                    />
                    I currently work here
                  </label>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    rows={3}
                    value={exp.description || ""}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder="Highlights, scope, impact…"
                  />
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pl-13">{formatRange(exp)}</div>
          </div>
        );
      })}

      {value.length > 0 && (
        <Button type="button" variant="outline" onClick={add} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add another role
        </Button>
      )}
    </div>
  );
};

export default ExperienceList;

