//g++ splash.cpp -O2 -std=c++11 -mwindows -lgdiplus -o splash.exe
#define _WIN32_WINNT 0x0501
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <gdiplus.h>
#include <cmath>
#include <algorithm>
using std::min;
#pragma comment(lib, "gdiplus.lib")
using namespace Gdiplus;
int dpi=96;
struct SplashState{
    float spinnerAngle=0.0f;
    float progress=0.0f;
    int step=0;
};
SplashState state;
const wchar_t* steps[]={
    L"Initializing application...",
    L"Loading core modules...",
    L"Preparing runtime...",
    L"Connecting services...",
    L"Finalizing UI...",
    L"Almost ready..."
};
constexpr int totalSteps=sizeof(steps)/sizeof(steps[0]);
void EnableDPIAwareness(){
    HMODULE user32=LoadLibraryW(L"user32.dll");
    if (!user32) return;
    typedef BOOL (WINAPI *SetDpiCtxFn)(HANDLE);
    SetDpiCtxFn setCtx=(SetDpiCtxFn)GetProcAddress(user32, "SetProcessDpiAwarenessContext");
    if (setCtx){
        setCtx((HANDLE)-4);
        FreeLibrary(user32);
        return;
    }
    typedef BOOL (WINAPI *SetProcessDPIAwareFn)(void);
    SetProcessDPIAwareFn setAware=(SetProcessDPIAwareFn)GetProcAddress(user32, "SetProcessDPIAware");
    if (setAware){
        setAware();
    }
    FreeLibrary(user32);
}
void UpdateDPI(HWND hwnd){
    dpi=96;
    HMODULE user32=GetModuleHandleW(L"user32.dll");
    if (user32){
        typedef UINT (WINAPI *GetDpiForWindowFn)(HWND);
        GetDpiForWindowFn getDpi=(GetDpiForWindowFn)GetProcAddress(user32, "GetDpiForWindow");
        if (getDpi){
            dpi=getDpi(hwnd);
        }
    }
}
int Scale(int v){
    return MulDiv(v, dpi, 96);
}
float EaseOutCubic(float t){
    return 1.0f-powf(1.0f-t, 3.0f);
}
void DrawRoundedRect(Graphics& g, RectF r, float radius, Color fill){
    GraphicsPath path;
    float d=radius*2.0f;
    path.AddArc(r.X, r.Y, d, d, 180, 90);
    path.AddArc(r.GetRight()-d, r.Y, d, d, 270, 90);
    path.AddArc(r.GetRight()-d, r.GetBottom()-d, d, d, 0, 90);
    path.AddArc(r.X, r.GetBottom()-d, d, d, 90, 90);
    path.CloseFigure();
    SolidBrush brush(fill);
    g.FillPath(&brush, &path);
}
void DrawSpinner(Graphics& g, float cx, float cy, float r, float angle){
    Pen pen(Color(255, 26, 115, 232), (REAL)Scale(4));
    pen.SetStartCap(LineCapRound);
    pen.SetEndCap(LineCapRound);
    RectF arc(cx-r, cy-r, r*2, r*2);
    g.DrawArc(&pen, arc, angle, 270);
}
void Paint(HWND hwnd){
    PAINTSTRUCT ps;
    HDC hdc=BeginPaint(hwnd, &ps);
    RECT rc;
    GetClientRect(hwnd, &rc);
    HDC memDC=CreateCompatibleDC(hdc);
    HBITMAP bmp=CreateCompatibleBitmap(hdc, rc.right, rc.bottom);
    HBITMAP oldBmp=(HBITMAP)SelectObject(memDC, bmp);
    Graphics g(memDC);
    g.SetSmoothingMode(SmoothingModeHighQuality);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
    SolidBrush bg(Color(255, 250, 250, 250));
    g.FillRectangle(&bg, 0, 0, rc.right, rc.bottom);
    float cx=rc.right/2.0f;
    float cy=(REAL)Scale(110);
    DrawSpinner(g, cx, cy, (REAL)Scale(42), state.spinnerAngle);
    DrawSpinner(g, cx, cy, (REAL)Scale(28), -state.spinnerAngle*1.5f);
    FontFamily segoe(L"Segoe UI");
    FontFamily tahoma(L"Tahoma");
    FontFamily* family=(segoe.GetLastStatus()== Ok)?&segoe:&tahoma;
    Font title(family, (REAL)Scale(32), FontStyleBold);
    Font body(family, (REAL)Scale(16), FontStyleRegular);
    StringFormat center;
    center.SetAlignment(StringAlignmentCenter);
    SolidBrush titleBrush(Color(255, 26, 115, 232));
    g.DrawString(
        L"Training Generator",
        -1,
        &title,
        PointF(cx, cy+Scale(35)),
        &center,
        &titleBrush
    );
    SolidBrush subBrush(Color(255, 95, 99, 104));
    g.DrawString(
        steps[state.step],
        -1,
        &body,
        PointF(cx, cy+Scale(105)),
        &center,
        &subBrush
    );
    float barW=rc.right*0.55f;
    float barH=(REAL)Scale(10);
    float barX=(rc.right-barW)/2.0f;
    float barY=cy+Scale(145);
    DrawRoundedRect(
        g,
        RectF(barX, barY, barW, barH),
        barH/2,
        Color(255, 230, 230, 230)
    );
    float eased=EaseOutCubic(state.progress);
    DrawRoundedRect(
        g,
        RectF(barX, barY, barW*eased, barH),
        barH/2,
        Color(255, 26, 115, 232)
    );
    BitBlt(hdc, 0, 0, rc.right, rc.bottom, memDC, 0, 0, SRCCOPY);
    SelectObject(memDC, oldBmp);
    DeleteObject(bmp);
    DeleteDC(memDC);
    EndPaint(hwnd, &ps);
}
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp){
    switch (msg){
    case WM_CREATE:
        UpdateDPI(hwnd);
        SetTimer(hwnd, 1, 16, nullptr);
        return 0;
    case WM_TIMER:
        state.spinnerAngle+=2.5f;
        if (state.spinnerAngle>=360.0f){
            state.spinnerAngle-=360.0f;
        }
        state.progress+=0.002f;
        if (state.progress>1.0f){
            state.progress=1.0f;
        }
        state.step=min((int)(state.progress*totalSteps), totalSteps-1);
        InvalidateRect(hwnd, nullptr, FALSE);
        return 0;
    case WM_PAINT:
        Paint(hwnd);
        return 0;
    case WM_ERASEBKGND:
        return 1;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wp, lp);
}
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE, LPSTR, int){
    EnableDPIAwareness();
    GdiplusStartupInput gsi;
    ULONG_PTR token;
    GdiplusStartup(&token, &gsi, nullptr);
    WNDCLASS wc={};
    wc.lpfnWndProc=WndProc;
    wc.hInstance=hInst;
    wc.lpszClassName=L"ModernSplashXP";
    wc.hCursor=LoadCursor(nullptr, IDC_ARROW);
    RegisterClass(&wc);
    int w=Scale(640);
    int h=Scale(420);
    HWND hwnd=CreateWindowEx(
        WS_EX_TOPMOST|WS_EX_TOOLWINDOW,
        wc.lpszClassName,
        L"",
        WS_POPUP|WS_VISIBLE,
        (GetSystemMetrics(SM_CXSCREEN)-w)/2,
        (GetSystemMetrics(SM_CYSCREEN)-h)/2,
        w, h,
        nullptr, nullptr, hInst, nullptr
    );
    MSG msg;
    while (GetMessage(&msg, nullptr, 0, 0)){
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    GdiplusShutdown(token);
    return 0;
}