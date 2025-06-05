// Container Component - connects module state to presentation
export function Container() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          About Pi Framework
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Pi is a Redux-based framework designed specifically for AI development workflows. 
          It completely separates application state from presentation state, making it the 
          ultimate framework for building frontends with AI assistance.
        </p>
      </div>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Core Philosophy
          </h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h3 className="font-medium text-gray-900">AI-Optimized</h3>
                <p className="text-gray-600">
                  Rigidly defined structures with simple, predictable patterns
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h3 className="font-medium text-gray-900">Node-Testable</h3>
                <p className="text-gray-600">
                  Full framework can be tested in Node.js environment with no browser dependencies
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h3 className="font-medium text-gray-900">No Waterfalls</h3>
                <p className="text-gray-600">
                  Data fetching handled by module thunks that integrate with routing
                </p>
              </div>
            </div>
          </div>
        </section>
        
        <section className="bg-gray-50 p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Perfect for AI Teams
          </h2>
          <p className="text-gray-700">
            Traditional frontend frameworks leave too much to interpretation. Pi provides 
            predictable structure, clear conventions, and simple patterns that AI can 
            understand and extend reliably.
          </p>
        </section>
      </div>
    </div>
  );
}