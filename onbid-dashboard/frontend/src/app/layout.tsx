import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온비드 공매 대시보드",
  description: "한국자산관리공사 온비드 공매 물건 투자 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-[#faf9f7]">
        <nav className="bg-white border-b border-[#d3d1c7] px-6 py-2 flex items-center gap-6">
          <a href="/" className="text-sm font-bold text-[#185fa5]">
            온비드 대시보드
          </a>
          <a
            href="/analytics"
            className="text-sm text-gray-600 hover:text-[#185fa5] transition-colors"
          >
            분석
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}
