import { CreateGroupForm } from './create-group-form';

export default function Home() {
  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold">Quick Split</h1>
        <p className="text-gray-600">Chia tiền nhóm nhanh. Tạo nhóm, gửi link cho bạn bè, không cần đăng nhập.</p>
      </div>
      <CreateGroupForm />
    </div>
  );
}
