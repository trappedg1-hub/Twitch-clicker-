import importlib.util
import unittest
spec=importlib.util.spec_from_file_location('prompt_lab','experiments/prompt-lab/build_workflow.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class GraphTests(unittest.TestCase):
 def test_graph(self):
  graph=m.build('model.safetensors','adult woman, pose','blur',832,1216,42,28,6)
  self.assertEqual(graph['2']['inputs']['text'],'adult woman, pose')
  self.assertEqual(graph['5']['inputs']['latent_image'],['4',0])
  self.assertEqual(graph['6']['inputs']['vae'],['1',2])
  self.assertEqual(graph['7']['inputs']['images'],['6',0])
 def test_invalid(self):
  for args in [('', 'ok','',832,1216,42,28,6),('x','ok','',831,1216,42,28,6),('x','ok','',832,1216,-1,28,6),('x','ok','',832,1216,42,0,6)]:
   with self.assertRaises(ValueError): m.build(*args)
if __name__=='__main__': unittest.main()
