import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/card_art.dart';
import '../../core/card_catalog.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

/// "Mẫu thẻ" strip — port of the web CardDesignPicker. Shows the bank's real
/// card designs (requested type first) plus a "Dùng màu" tile; picking a
/// design hands it back so the form can fill the card's name and network.
class CardDesignPicker extends ConsumerStatefulWidget {
  final String bankShortName;
  final String bankName;
  final String cardType;
  final String value; // current cardImage ('' = none)
  final void Function(String src, CardDesign? design) onChanged;

  const CardDesignPicker({
    super.key,
    required this.bankShortName,
    required this.bankName,
    required this.cardType,
    required this.value,
    required this.onChanged,
  });

  @override
  ConsumerState<CardDesignPicker> createState() => _CardDesignPickerState();
}

class _CardDesignPickerState extends ConsumerState<CardDesignPicker> {
  CardCatalog? _catalog;
  String _filter = '';
  bool _uploading = false;

  /// Own photo → Cloudinary (chi_tieu/cards), resized on device first.
  Future<void> _uploadOwn() async {
    final messenger = ScaffoldMessenger.of(context);
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploading = true);
    try {
      final url = await ref.read(financeServiceProvider).uploadImage(picked.path, folder: 'chi_tieu/cards');
      widget.onChanged(url, null);
      messenger.showSnackBar(const SnackBar(content: Text('Đã tải ảnh thẻ')));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Tải ảnh thất bại')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    CardCatalog.load().then((c) {
      if (mounted) setState(() => _catalog = c);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cat = _catalog;
    if (cat == null) return const SizedBox(height: 96);
    final all = cat.designsFor(widget.bankShortName, widget.bankName, widget.cardType);
    final q = _filter.trim().toLowerCase();
    final shown = q.isEmpty ? all : all.where((d) => d.name.toLowerCase().contains(q)).toList();
    final selected = cat.designBySrc(widget.value);
    final hasCustom = widget.value.isNotEmpty && !widget.value.startsWith('/cards/');

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('Mẫu thẻ', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        if (all.isNotEmpty) Text('  (${all.length} mẫu)', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
        const Spacer(),
        if (all.length > 8)
          SizedBox(
            width: 130,
            height: 32,
            child: TextField(
              onChanged: (v) => setState(() => _filter = v),
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                hintText: 'Tìm mẫu...',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
      ]),
      const SizedBox(height: 8),
      SizedBox(
        height: 74,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            _tile(
              selected: widget.value.isEmpty,
              onTap: () => widget.onChanged('', null),
              child: const Center(child: Text('Dùng màu', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400))),
              dashed: true,
            ),
            _tile(
              selected: hasCustom,
              onTap: _uploading ? () {} : _uploadOwn,
              dashed: !hasCustom,
              child: hasCustom
                  ? Stack(fit: StackFit.expand, children: [
                      Image(image: cardImageProvider(widget.value, small: true)!, fit: BoxFit.cover),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Container(
                          width: double.infinity, color: Colors.black45, padding: const EdgeInsets.symmetric(vertical: 2),
                          child: const Text('Ảnh của bạn · đổi', textAlign: TextAlign.center, style: TextStyle(fontSize: 9, color: Colors.white)),
                        ),
                      ),
                    ])
                  : Center(
                      child: Text(_uploading ? 'Đang tải…' : '＋ Ảnh của bạn',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400)),
                    ),
            ),
            for (final d in shown)
              _tile(
                selected: widget.value == d.src,
                onTap: () => widget.onChanged(d.src, d),
                child: Image.asset('assets${thumbSrc(d.src)}', fit: BoxFit.cover, gaplessPlayback: true),
              ),
          ],
        ),
      ),
      const SizedBox(height: 4),
      Text(
        selected != null
            ? 'Đã chọn ${selected.name}.'
            : all.isEmpty
                ? 'Chưa có mẫu cho ngân hàng này — nhập đúng tên ngân hàng (vd: VPBank, VCB).'
                : 'Chọn đúng mẫu thẻ bạn đang dùng để dễ nhận ra. Ảnh tự tải nên che số thẻ, tên, ngày hết hạn; không chụp mặt sau (CVV).',
        style: const TextStyle(fontSize: 11, color: AppColors.slate400),
      ),
    ]);
  }

  Widget _tile({required bool selected, required VoidCallback onTap, required Widget child, bool dashed = false}) {
    return Padding(
      padding: const EdgeInsets.only(right: 10, top: 3, bottom: 3),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 108,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? AppColors.brand : (dashed ? AppColors.slate200 : Colors.black.withValues(alpha: 0.08)),
              width: selected ? 3 : 1.5,
            ),
          ),
          child: ClipRRect(borderRadius: BorderRadius.circular(8), child: child),
        ),
      ),
    );
  }
}
