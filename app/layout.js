import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ByteBill",
  description: "One stop Finance Platform",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/minilogo.png" sizes="any" />
        </head>
        <body className={`${inter.className}`}>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors />

          <footer className=" bg-blue-400 py-12">
            <div className="container mx-auto px-4 text-center  text-2xl text-white">
              <p>Made By SixthSense</p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}