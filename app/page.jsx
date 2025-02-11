export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
      <div className="max-w-3xl mx-auto text-center space-y-8 p-8">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to MediBook</h1>
        <p className="text-xl text-muted-foreground">
          Schedule and manage your medical appointments with ease
        </p>
      </div>
    </div>
  );
}