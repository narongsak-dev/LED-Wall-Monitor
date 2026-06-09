import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="ไม่พบหน้านี้"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          กลับหน้าหลัก
        </Button>
      }
    />
  );
}
