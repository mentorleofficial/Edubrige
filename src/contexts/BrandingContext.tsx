import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BrandingConfig {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_bg_url: string | null;
}

const defaultBranding: BrandingConfig = {
  app_name: "Mentorship Platform",
  logo_url: null,
  primary_color: "199 89% 32%",
  secondary_color: "40 33% 94%",
  accent_color: "31 95% 55%",
  login_bg_url: null,
};

const BrandingContext = createContext<BrandingConfig>(defaultBranding);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);

  useEffect(() => {
    const fetchBranding = async () => {
      const { data } = await supabase.from("branding").select("*").limit(1).single();
      if (data) {
        const config: BrandingConfig = {
          app_name: data.app_name,
          logo_url: data.logo_url,
          primary_color: data.primary_color,
          secondary_color: data.secondary_color,
          accent_color: data.accent_color,
          login_bg_url: data.login_bg_url,
        };
        setBranding(config);

        // Apply to CSS custom properties
        const root = document.documentElement;
        root.style.setProperty("--primary", config.primary_color);
        root.style.setProperty("--secondary", config.secondary_color);
        root.style.setProperty("--accent", config.accent_color);
      }
    };
    fetchBranding();
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
