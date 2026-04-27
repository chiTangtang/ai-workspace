import { redirect } from 'next/navigation';

/** 首页 - 重定向到对话页面 */
export default function Home() {
  redirect('/chat');
}
