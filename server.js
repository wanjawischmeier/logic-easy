import express from 'express'
import path from 'node:path'

const app = express()
const distPath = path.resolve('dist')

app.use('/logic-easy', express.static(distPath))

app.get('/logic-easy/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(3000, () => {
  console.log('http://localhost:3000')
})