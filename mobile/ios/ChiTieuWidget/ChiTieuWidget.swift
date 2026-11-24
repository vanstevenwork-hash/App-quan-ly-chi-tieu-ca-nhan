import SwiftUI
import WidgetKit

// Home-screen widgets for Chi Tiêu. The Flutter app writes one JSON blob
// ("widget_data") into the shared App Group (lib/core/home_widget_sync.dart);
// these widgets only read and render it. Taps deep-link back into the app:
//   chitieu://add?homeWidget        → Thêm giao dịch
//   chitieu://scan?homeWidget       → Quét Bill
//   chitieu://statements?homeWidget → Lịch sao kê

private let appGroup = "group.com.chitieu.chitieuMobile"

// MARK: - Data

struct DueItem: Decodable, Hashable {
    let name: String
    let bank: String?
    let last4: String?
    let amount: Double
    let days: Int?
    let dueDate: String?
}

struct WidgetPayload: Decodable {
    let hidden: Bool
    let today: Double
    let month: Double
    let income: Double
    let monthLabel: String
    let dues: [DueItem]
    let dueTotal: Double

    static func load() -> WidgetPayload? {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "widget_data"),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }

    static let sample = WidgetPayload(
        hidden: false, today: 185_000, month: 26_815_495, income: 30_000_000, monthLabel: "Tháng 11",
        dues: [
            DueItem(name: "VIB One Signature", bank: "VIB", last4: "4840", amount: 23_600_000, days: 21, dueDate: "15/12"),
            DueItem(name: "ACB", bank: "ACB", last4: "8043", amount: 40_900_000, days: 16, dueDate: "10/12"),
            DueItem(name: "SHB World", bank: "SHB", last4: "6760", amount: 945_997, days: 3, dueDate: "27/11"),
        ],
        dueTotal: 65_445_997)
}

struct Entry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, payload: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: .now, payload: context.isPreview ? (WidgetPayload.load() ?? .sample) : WidgetPayload.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // The app pushes fresh data on every change; also tick at midnight so
        // "hôm nay" / "còn N ngày" roll over without opening the app.
        let next = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [Entry(date: .now, payload: WidgetPayload.load())], policy: .after(next)))
    }
}

// MARK: - Style

private let brand = Color(red: 0x36 / 255, green: 0x25 / 255, blue: 0x5C / 255)
private let brandEnd = Color(red: 0x9B / 255, green: 0x4D / 255, blue: 0xE8 / 255)
private let slate400 = Color(red: 0x94 / 255, green: 0xA3 / 255, blue: 0xB8 / 255)
private let slate500 = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)
private let slate800 = Color(red: 0x1E / 255, green: 0x29 / 255, blue: 0x3B / 255)
private let rose = Color(red: 0xF4 / 255, green: 0x3F / 255, blue: 0x5E / 255)
private let emerald = Color(red: 0x05 / 255, green: 0x96 / 255, blue: 0x69 / 255)
private let amber = Color(red: 0xD9 / 255, green: 0x77 / 255, blue: 0x06 / 255)

private func money(_ v: Double, hidden: Bool) -> String {
    if hidden { return "•••••" }
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.groupingSeparator = ","
    f.maximumFractionDigits = 0
    return (f.string(from: NSNumber(value: v.rounded())) ?? "0") + "đ"
}

private func short(_ v: Double, hidden: Bool) -> String {
    if hidden { return "•••" }
    let a = abs(v)
    if a >= 1e9 { return String(format: "%.1f tỷ", a / 1e9) }
    if a >= 1e6 { return String(format: "%.1ftr", a / 1e6) }
    if a >= 1e3 { return "\(Int((a / 1e3).rounded()))k" }
    return "\(Int(a))"
}

private func link(_ action: String) -> URL { URL(string: "chitieu://\(action)?homeWidget")! }

extension View {
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            background(color)
        }
    }
}

private let pageBg = Color(red: 0xF8 / 255, green: 0xF9 / 255, blue: 0xFF / 255)

struct SignedOutView: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("Mở app để đăng nhập").font(.system(size: 12, weight: .semibold)).foregroundStyle(slate500)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - "Chi tiêu" widget (small / medium)

struct ActionButton: View {
    let title: String
    let action: String
    let filled: Bool
    var body: some View {
        Link(destination: link(action)) {
            Text(title).font(.system(size: 12, weight: .bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .foregroundStyle(filled ? Color.white : brand)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(filled ? AnyShapeStyle(LinearGradient(colors: [brand, brandEnd], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(Color.white))
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(filled ? Color.clear : brand.opacity(0.35), lineWidth: 1.2))
        }
    }
}

struct SpendingView: View {
    @Environment(\.widgetFamily) var family
    let p: WidgetPayload

    var body: some View {
        if family == .systemSmall { small } else { medium }
    }

    private var header: some View {
        HStack(spacing: 4) {
            Text("CHI HÔM NAY").font(.system(size: 10, weight: .heavy)).foregroundStyle(slate400).tracking(0.6)
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Text(money(p.today, hidden: p.hidden))
                .font(.system(size: 20, weight: .heavy)).foregroundStyle(slate800)
                .minimumScaleFactor(0.6).lineLimit(1).padding(.top, 4)
            Text("\(p.monthLabel): \(short(p.month, hidden: p.hidden))")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(slate500).padding(.top, 2)
            Spacer(minLength: 0)
            HStack {
                if let d = p.dues.first, let days = d.days {
                    Text(days <= 0 ? "Hạn hôm nay" : "Sao kê \(days)N").font(.system(size: 10, weight: .bold))
                        .foregroundStyle(days <= 3 ? rose : amber).lineLimit(1)
                }
                Spacer(minLength: 0)
                Link(destination: link("add")) {
                    Text("+").font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(LinearGradient(colors: [brand, brandEnd], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var medium: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                header
                Text(money(p.today, hidden: p.hidden))
                    .font(.system(size: 22, weight: .heavy)).foregroundStyle(slate800)
                    .minimumScaleFactor(0.6).lineLimit(1).padding(.top, 4)
                Spacer(minLength: 6)
                row(label: "Chi \(p.monthLabel.lowercased())", value: short(p.month, hidden: p.hidden), color: rose)
                row(label: "Thu \(p.monthLabel.lowercased())", value: short(p.income, hidden: p.hidden), color: emerald).padding(.top, 3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 8) {
                ActionButton(title: "+ Thêm", action: "add", filled: true)
                ActionButton(title: "Quét Bill", action: "scan", filled: false)
                if let d = p.dues.first, let days = d.days {
                    Link(destination: link("statements")) {
                        Text(days <= 0 ? "Hạn sao kê hôm nay" : "Sao kê còn \(days) ngày")
                            .font(.system(size: 10, weight: .bold)).foregroundStyle(days <= 3 ? rose : amber).lineLimit(1)
                    }
                }
            }
            .frame(width: 118)
        }
    }

    private func row(label: String, value: String, color: Color) -> some View {
        HStack {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.system(size: 11, weight: .medium)).foregroundStyle(slate500).lineLimit(1)
            Spacer(minLength: 4)
            Text(value).font(.system(size: 12, weight: .bold)).foregroundStyle(slate800)
        }
    }
}

struct ChiTieuWidgetView: View {
    let entry: Entry
    var body: some View {
        Group {
            if let p = entry.payload { SpendingView(p: p) } else { SignedOutView() }
        }
        .widgetBackground(pageBg)
        .widgetURL(link("add"))
    }
}

struct ChiTieuWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ChiTieuWidget", provider: Provider()) { entry in
            ChiTieuWidgetView(entry: entry)
        }
        .configurationDisplayName("Chi tiêu")
        .description("Chi hôm nay, chi/thu tháng này và nút thêm giao dịch nhanh.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - "Sao kê" widget (medium / large)

struct DueRow: View {
    let d: DueItem
    let hidden: Bool
    var body: some View {
        let urgent = (d.days ?? 99) <= 3
        HStack(spacing: 10) {
            Text(String((d.bank?.isEmpty == false ? d.bank! : d.name).prefix(4)).uppercased())
                .font(.system(size: 9, weight: .heavy)).foregroundStyle(brand)
                .frame(width: 34, height: 24)
                .background(RoundedRectangle(cornerRadius: 6).fill(brand.opacity(0.1)))
            VStack(alignment: .leading, spacing: 1) {
                Text(d.name).font(.system(size: 12, weight: .bold)).foregroundStyle(slate800).lineLimit(1)
                Text(d.dueDate.map { "Hạn \($0)" + ((d.last4 ?? "").isEmpty ? "" : " · ••\(d.last4!)") } ?? "Cần thanh toán")
                    .font(.system(size: 10)).foregroundStyle(slate400).lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text(short(d.amount, hidden: hidden)).font(.system(size: 13, weight: .heavy)).foregroundStyle(rose)
                if let days = d.days {
                    Text(days <= 0 ? "Hôm nay" : "Còn \(days) ngày")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(urgent ? Color.white : rose)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(urgent ? rose : rose.opacity(0.1)))
                }
            }
        }
    }
}

struct StatementsView: View {
    @Environment(\.widgetFamily) var family
    let p: WidgetPayload
    var body: some View {
        let limit = family == .systemLarge ? 6 : 2
        VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 7) {
            HStack {
                Text("SAO KÊ SẮP ĐẾN HẠN").font(.system(size: 10, weight: .heavy)).foregroundStyle(slate400).tracking(0.6)
                Spacer()
                if !p.dues.isEmpty {
                    Text(short(p.dueTotal, hidden: p.hidden)).font(.system(size: 12, weight: .heavy)).foregroundStyle(rose)
                }
            }
            if p.dues.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Text("Không có sao kê cần trả").font(.system(size: 12, weight: .semibold)).foregroundStyle(slate500)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(p.dues.prefix(limit), id: \.self) { DueRow(d: $0, hidden: p.hidden) }
                if p.dues.count > limit {
                    Text("+\(p.dues.count - limit) thẻ khác").font(.system(size: 10, weight: .semibold)).foregroundStyle(slate400)
                }
                Spacer(minLength: 0)
            }
            if family == .systemLarge {
                HStack(spacing: 8) {
                    ActionButton(title: "+ Thêm giao dịch", action: "add", filled: true)
                    ActionButton(title: "Quét Bill", action: "scan", filled: false)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct SaoKeWidgetView: View {
    let entry: Entry
    var body: some View {
        Group {
            if let p = entry.payload { StatementsView(p: p) } else { SignedOutView() }
        }
        .widgetBackground(pageBg)
        .widgetURL(link("statements"))
    }
}

struct SaoKeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SaoKeWidget", provider: Provider()) { entry in
            SaoKeWidgetView(entry: entry)
        }
        .configurationDisplayName("Sao kê")
        .description("Các thẻ tín dụng sắp đến hạn thanh toán.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct ChiTieuWidgetBundle: WidgetBundle {
    var body: some Widget {
        ChiTieuWidget()
        SaoKeWidget()
    }
}
