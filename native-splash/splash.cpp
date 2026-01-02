//g++ splash-modified.cpp -O2 -mwindows -o splash-modified.exe
#include <windows.h>
#include <math.h>
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp);
const char* steps[]={
    "Initializing application...",
    "Loading core modules...",
    "Setting up file parser...",
    "Connecting to Ollama...",
    "Preparing user interface...",
    "Almost ready..."
};
int totalSteps=sizeof(steps)/sizeof(steps[0]);
struct SplashState{
    int progress;
    int stepIndex;
    const char* message;
    int angle;
};
SplashState splashState={0, 0, steps[0], 0};
void PaintSplash(HWND hwnd){
    PAINTSTRUCT ps;
    HDC hdc=BeginPaint(hwnd, &ps);
    RECT rect;
    GetClientRect(hwnd, &rect);
    HBRUSH bg=CreateSolidBrush(RGB(250,250,250));
    FillRect(hdc, &rect, bg);
    DeleteObject(bg);

    int cx=rect.right/2;
    int cy=rect.top+80;
    int r=30;
    int startAngle=splashState.angle;
    int endAngle=startAngle+270;
    HBRUSH spinnerBrush=CreateSolidBrush(RGB(26,115,232));
    HBRUSH oldBrush=(HBRUSH)SelectObject(hdc, spinnerBrush);
    POINT center={cx, cy};
    POINT pt[4];
    pt[0]=center;
    double radStart=startAngle*3.14159265/180.0;
    double radEnd=endAngle*3.14159265/180.0;
    pt[1].x=cx+(int)(r*cos(radStart));
    pt[1].y=cy - (int)(r*sin(radStart));
    pt[2].x=cx+(int)(r*cos(radEnd));
    pt[2].y=cy - (int)(r*sin(radEnd));
    pt[3]=center;
    Polygon(hdc, pt, 3);
    SelectObject(hdc, oldBrush);
    DeleteObject(spinnerBrush);
    HFONT hTitle=[](){ NONCLIENTMETRICS ncm={ sizeof(NONCLIENTMETRICS) }; SystemParametersInfo(SPI_GETNONCLIENTMETRICS, sizeof(ncm), &ncm, 0); ncm.lfMessageFont.lfHeight=-40; return CreateFontIndirect(&ncm.lfMessageFont); }();
    HFONT oldFont=(HFONT)SelectObject(hdc,hTitle);
    SetTextColor(hdc, RGB(26,115,232));
    SetBkMode(hdc, TRANSPARENT);
    RECT titleRect={0, cy+40, rect.right, cy+100};
    DrawTextA(hdc, "Training Generator", -1, &titleRect, DT_CENTER|DT_SINGLELINE);
    SelectObject(hdc, oldFont);
    DeleteObject(hTitle);
    HFONT hSub=[](){ NONCLIENTMETRICS ncm={sizeof(NONCLIENTMETRICS)}; SystemParametersInfo(SPI_GETNONCLIENTMETRICS,sizeof(ncm),&ncm,0); ncm.lfMessageFont.lfHeight=-16; ncm.lfMessageFont.lfWeight=FW_NORMAL; return CreateFontIndirect(&ncm.lfMessageFont); }();
    oldFont=(HFONT)SelectObject(hdc,hSub);
    SetTextColor(hdc, RGB(95,99,104));
    RECT subRect={0, cy+110, rect.right, cy+140};
    DrawTextA(hdc, splashState.message, -1, &subRect, DT_CENTER|DT_SINGLELINE);
    SelectObject(hdc, oldFont);
    DeleteObject(hSub);
    RECT progRect={rect.right/4, cy+160, rect.right*3/4, cy+180};
    HBRUSH bgBar=CreateSolidBrush(RGB(243,243,243));
    FillRect(hdc, &progRect, bgBar);
    DeleteObject(bgBar);
    int progWidth=((progRect.right-progRect.left)*splashState.progress)/100;
    RECT fgRect={progRect.left, progRect.top, progRect.left+progWidth, progRect.bottom};
    HBRUSH fgBar=CreateSolidBrush(RGB(26,115,232));
    FillRect(hdc, &fgRect, fgBar);
    DeleteObject(fgBar);
    EndPaint(hwnd,&ps);
}
void UpdateProgress(HWND hwnd){
    splashState.angle+=15;
    if(splashState.angle>=360) splashState.angle-=360;
    static int counter=0;
    counter++;
    if(counter%2==0){ 
        splashState.stepIndex = (splashState.stepIndex+1)%totalSteps;
        splashState.message=steps[splashState.stepIndex];
        splashState.progress=((splashState.stepIndex+1)*100)/totalSteps;
    }
    InvalidateRect(hwnd,NULL,TRUE);
}
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp){
    switch(msg){
        case WM_PAINT: PaintSplash(hwnd); return 0;
        case WM_TIMER: UpdateProgress(hwnd); return 0;
        case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProc(hwnd,msg,wp,lp);
}
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE, LPSTR, int){
    WNDCLASSA wc={};
    wc.lpfnWndProc=WndProc;
    wc.hInstance=hInst;
    wc.lpszClassName="NativeSplashSpinner";
    RegisterClassA(&wc);
    int width=500, height=300;
    int x=(GetSystemMetrics(SM_CXSCREEN)-width)/2;
    int y=(GetSystemMetrics(SM_CYSCREEN)-height)/2;
    HWND hwnd=CreateWindowExA(
        WS_EX_TOPMOST|WS_EX_TOOLWINDOW,
        wc.lpszClassName,
        "",
        WS_POPUP,
        x,y,width,height,
        NULL,NULL,hInst,NULL
    );
    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);
    SetForegroundWindow(hwnd);
    SetWindowPos(hwnd, HWND_TOPMOST,0,0,0,0, SWP_NOMOVE|SWP_NOSIZE);
    SetTimer(hwnd,1,100,NULL);
    MSG msg;
    while(GetMessage(&msg,NULL,0,0)){
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return 0;
}