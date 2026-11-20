Pod::Spec.new do |s|
  s.name = 'HeyHangerVision'
  s.version = '0.1.0'
  s.summary = 'Local HeyHanger vision inference'
  s.description = s.summary
  s.author = 'HeyHanger'
  s.homepage = 'https://github.com/vudigapranav/CLOSIQ'
  s.license = { :type => 'MIT' }
  s.source = { :git => s.homepage + '.git' }
  s.platform = :ios, '16.4'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.swift_version = '5.9'
  spm_dependency(s, url: 'https://github.com/google-ai-edge/LiteRT-LM',
                 requirement: {kind: 'exactVersion', version: '0.19.1'}, products: ['LiteRTLM'])
end
