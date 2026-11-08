using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

class Program
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14;

    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;

    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_MBUTTONUP = 0x0208;
    private const int WM_XBUTTONDOWN = 0x020B;
    private const int WM_XBUTTONUP = 0x020C;

    private delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int pt_x;
        public int pt_y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT
    {
        public int pt_x;
        public int pt_y;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    private static IntPtr _kbHook = IntPtr.Zero;
    private static IntPtr _mouseHook = IntPtr.Zero;
    private static LowLevelProc _kbProc = KbHookCallback;
    private static LowLevelProc _mouseProc = MouseHookCallback;

    public static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.WriteLine("HOOK_READY");
        Console.Out.Flush();

        // Listen for stdin close to terminate cleanly
        System.Threading.ThreadPool.QueueUserWorkItem((_) =>
        {
            try
            {
                while (Console.ReadLine() != null) { }
            }
            catch { }
            Environment.Exit(0);
        });

        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule)
        {
            IntPtr modHandle = GetModuleHandle(curModule.ModuleName);
            _kbHook = SetWindowsHookEx(WH_KEYBOARD_LL, _kbProc, modHandle, 0);
            _mouseHook = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, modHandle, 0);
        }

        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        UnhookWindowsHookEx(_kbHook);
        UnhookWindowsHookEx(_mouseHook);
    }

    private static IntPtr KbHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = wParam.ToInt32();
            bool isDown = (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN);
            bool isUp = (msg == WM_KEYUP || msg == WM_SYSKEYUP);

            if (isDown || isUp)
            {
                int vkCode = Marshal.ReadInt32(lParam);
                string keyName = MapVkToKeyName(vkCode);
                if (!string.IsNullOrEmpty(keyName))
                {
                    string action = isDown ? "DOWN" : "UP";
                    Console.WriteLine(action + ":" + keyName);
                    Console.Out.Flush();
                }
            }
        }
        return CallNextHookEx(_kbHook, nCode, wParam, lParam);
    }

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = wParam.ToInt32();
            if (msg == WM_XBUTTONDOWN || msg == WM_XBUTTONUP)
            {
                MSLLHOOKSTRUCT data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                uint button = (data.mouseData >> 16) & 0xFFFF;
                string btnName = (button == 1) ? "Mouse4" : ((button == 2) ? "Mouse5" : "");
                if (!string.IsNullOrEmpty(btnName))
                {
                    string action = (msg == WM_XBUTTONDOWN) ? "DOWN" : "UP";
                    Console.WriteLine(action + ":" + btnName);
                    Console.Out.Flush();
                }
            }
            else if (msg == WM_MBUTTONDOWN || msg == WM_MBUTTONUP)
            {
                string action = (msg == WM_MBUTTONDOWN) ? "DOWN" : "UP";
                Console.WriteLine(action + ":Mouse3");
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(_mouseHook, nCode, wParam, lParam);
    }

    private static string MapVkToKeyName(int vk)
    {
        if (vk >= 0x41 && vk <= 0x5A) // A-Z
            return "Key" + ((char)vk).ToString();
        if (vk >= 0x30 && vk <= 0x39) // 0-9
            return "Digit" + ((char)vk).ToString();
        if (vk >= 0x70 && vk <= 0x87) // F1-F24
            return "F" + (vk - 0x6F).ToString();

        switch (vk)
        {
            case 0xA2: return "ControlLeft";
            case 0xA3: return "ControlRight";
            case 0x11: return "ControlRight"; // VK_CONTROL fallback
            case 0xA0: return "ShiftLeft";
            case 0xA1: return "ShiftRight";
            case 0x10: return "ShiftLeft";
            case 0xA4: return "AltLeft";
            case 0xA5: return "AltRight";
            case 0x12: return "AltLeft";
            case 0x20: return "Space";
            case 0xC0: return "Backquote";
            case 0x14: return "CapsLock";
            case 0x09: return "Tab";
            case 0x0D: return "Enter";
            case 0x1B: return "Escape";
            case 0x2E: return "Delete";
            case 0x2D: return "Insert";
            case 0x24: return "Home";
            case 0x23: return "End";
            case 0x21: return "PageUp";
            case 0x22: return "PageDown";
            case 0x25: return "ArrowLeft";
            case 0x26: return "ArrowUp";
            case 0x27: return "ArrowRight";
            case 0x28: return "ArrowDown";
            default: return null;
        }
    }
}
