import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Gourmaison | Home",
  description: "Gourmaison.in",
};

export default function RootLayout({ children }) {
  return (
   <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="main-boxy min-h-screen px-6 pb-6 pt-20 md:ml-64 md:px-6 md:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
