using WeddingLive.Endpoints;
using WeddingLive.Hubs;
using WeddingLive.Models;
using WeddingLive.Services;

var builder = WebApplication.CreateBuilder(args);

// Đọc mục "Wedding" trong appsettings.json vào WeddingOptions (sửa file là tự cập nhật, không cần restart)
builder.Services.Configure<WeddingOptions>(builder.Configuration.GetSection(WeddingOptions.Section));

// SignalR: kênh realtime server -> trình duyệt
builder.Services.AddSignalR();

// Các service dùng chung toàn app
builder.Services.AddSingleton<LeaderboardService>();
builder.Services.AddSingleton<BridgeStatusStore>();
builder.Services.AddSingleton<GiftQueueService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<GiftQueueService>());

// Cho phép tiktok-bridge / TikFinity chạy ở máy khác gọi vào
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseDefaultFiles();   // "/" -> wwwroot/index.html
app.UseStaticFiles();    // phục vụ js, css, lib trong wwwroot

app.MapHub<WeddingHub>("/hub/wedding");
app.MapLiveEndpoints();
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();
