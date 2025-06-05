// Container Component - connects module state to presentation
export function Container() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Pi Framework
        </h1>
        <p className="text-lg text-gray-600">
          The AI-First Frontend Framework
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">
            Complete State Separation
          </h2>
          <p className="text-blue-700">
            Application logic lives entirely separate from presentation, 
            making it perfect for AI-assisted development.
          </p>
        </div>
        
        <div className="bg-green-50 p-6 border border-green-200">
          <h2 className="text-xl font-semibold text-green-900 mb-3">
            Zero Ambiguity
          </h2>
          <p className="text-green-700">
            Clear folder structure, naming conventions, and API patterns 
            that AI can easily understand and replicate.
          </p>
        </div>
        
        <div className="bg-purple-50 p-6 border border-purple-200">
          <h2 className="text-xl font-semibold text-purple-900 mb-3">
            Pure Presentation
          </h2>
          <p className="text-purple-700">
            Views are purely f(state) with no side effects, 
            no complexity, just clean rendering logic.
          </p>
        </div>
        
        <div className="bg-orange-50 p-6 border border-orange-200">
          <h2 className="text-xl font-semibold text-orange-900 mb-3">
            Built-in Router
          </h2>
          <p className="text-orange-700">
            Router hooks directly into module thunks, 
            eliminating data fetching waterfalls.
          </p>
        </div>
      </div>
    </div>
  );
}