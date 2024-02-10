import Navigation from "@/components/site/navigation";
import React from "react";

type Props = {
  children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
  return (
    <main className="h-full">
      <Navigation />
      {children}
    </main>
  );
};

export default Layout;
