import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  // 디자인 시스템 토큰 사용 (이전엔 slate/blue/white 하드코딩으로 앱과 동떨어진
  // 오프-브랜드 화면이었음). 레이아웃 <main> 안에 렌더되므로 min-h-screen 대신
  // min-h-[60vh] 로 과도한 높이 방지.
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Card className="mx-4 w-full max-w-lg">
        <CardContent className="px-6 py-10 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/10" />
              <AlertCircle className="relative h-16 w-16 text-destructive" />
            </div>
          </div>

          <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>

          <h2 className="mb-4 text-xl font-semibold text-foreground">
            페이지를 찾을 수 없어요
          </h2>

          <p className="mb-8 leading-relaxed text-muted-foreground">
            요청하신 페이지가 존재하지 않습니다.
            <br />
            이동되었거나 삭제되었을 수 있어요.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => setLocation("/")}>
              <Home className="mr-2 h-4 w-4" />
              홈으로
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
