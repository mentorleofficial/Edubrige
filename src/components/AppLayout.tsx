import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import ApprovalCelebrationModal from "@/features/mentor-approval/ApprovalCelebrationModal";
import ConsentBanner from "@/components/ConsentBanner";
import NotificationBell from "@/components/NotificationBell";
import FeedbackWidget from "@/components/FeedbackWidget";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center justify-between border-b px-3 sm:px-4 md:px-6 py-2 sm:py-3">
            <SidebarTrigger />
            <NotificationBell />
          </div>
          <ConsentBanner />
          <div className="p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
      <ApprovalCelebrationModal />
      <FeedbackWidget />
    </SidebarProvider>
  );
};

export default AppLayout;

