import React from "react";
import Navigation from "@/components/site/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

type Props = {
  children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <main className="h-full">
        <Navigation />
        {children}
      </main>
    </ClerkProvider>
  );
};

export default Layout;
