import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="container mx-auto px-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Powered by</span>
          <Image
            src="https://kaizentech.co.za/kaizentech.svg"
            alt="KaizenTech"
            width={120}
            height={30}
            className="h-[30px] w-auto"
          />
        </div>
      </div>
    </footer>
  );
}