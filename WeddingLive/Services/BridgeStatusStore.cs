using WeddingLive.Models;

namespace WeddingLive.Services;

/// <summary>Giữ trạng thái mới nhất mà bridge TikTok báo về.</summary>
public class BridgeStatusStore
{
    public BridgeStatus Current { get; set; } = new() { Connected = false, Message = "Chưa có bridge kết nối" };
}
