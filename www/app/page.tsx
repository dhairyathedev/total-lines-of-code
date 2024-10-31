import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import React from "react";

export default function Home() {
  return (
    <div className="max-w-screen-md mx-auto m-2 p-4">
      <h1 className="text-2xl font-bold">totallinesofcode.com</h1>
      <div className="flex items-center justify-center mt-20">
      <Button size="sm">
        <GitHubLogoIcon className="w-5 h-5" />
        Login with GitHub
      </Button>
      </div>
    </div>
  );
}
