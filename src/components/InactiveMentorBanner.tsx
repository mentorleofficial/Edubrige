import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock } from "lucide-react";

const InactiveMentorBanner = () => (
  <Alert className="border-accent bg-accent/10">
    <Clock className="h-4 w-4" />
    <AlertTitle>Account Pending Activation</AlertTitle>
    <AlertDescription>
      Your mentor account is approved but not yet active. You can complete your profile while an admin
      finalizes activation. Availability and session features will unlock once you're activated.
    </AlertDescription>
  </Alert>
);

export default InactiveMentorBanner;
