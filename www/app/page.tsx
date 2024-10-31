"use client"
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import React from "react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="max-w-screen-md mx-auto m-2 p-4">
      <h1 className="text-2xl font-bold">totallinesofcode.com</h1>
      <div className="flex items-center justify-center mt-20">
        {session ? (
          <div>
            <p>Signed in as {session.user?.name}</p>
            <pre
              className="text-sm font-mono"
            >
              {JSON.stringify(session, null, 2)}
            </pre>
            <Button size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => signIn("github")}>
              {status}
              <GitHubLogoIcon className="w-5 h-5" />
              Login with GitHub
            </Button>
        )}
      </div>
    </div>
  );
}