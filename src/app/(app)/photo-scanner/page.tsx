import { redirect } from 'next/navigation';

export default function PhotoScannerPage() {
  redirect('/diary/add-food?mode=image');
}
