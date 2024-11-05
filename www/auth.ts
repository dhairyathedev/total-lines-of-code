import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { JWT } from "next-auth/jwt"

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    userId?: string
    accessTokenExpires?: number
    error?: string
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
    authorization:{
      params: { scope: "repo read:user" }
    }
  })],
  callbacks: {
    async jwt({ token, account, user }: { token: JWT, account: any, user: any }) {
      // Persist the OAuth access_token to the token right after signin
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          userId: account.providerAccountId,
          accessTokenExpires: account.expires_at * 1000,
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
    async session({ session, token }: { session: any, token: JWT }) {
      session.user.accessToken = token.accessToken
      session.user.refreshToken = token.refreshToken
      session.user.userId = token.userId

      return session
    },
  },
})

async function refreshAccessToken(token: JWT) {
  try {
    // You can add refresh token logic here if GitHub provides refresh tokens
    // For now, we'll just return the existing token
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  } catch (error) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}