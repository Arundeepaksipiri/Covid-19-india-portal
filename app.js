const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null
const intializeDBAndServer = async () => {
  try {
    app.listen(3000, () => {
      console.log('Server starting http://localhost:3000/')
    })
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
  } catch (e) {
    console.log(`Db Error ${e.meesage}`)
  }
}
intializeDBAndServer()
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const loginQuery = `
  SELECT * FROM user WHERE username='${username}'`
  const loginArray = await db.get(loginQuery)
  if (loginArray === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isMatched = await bcrypt.compare(password, loginArray.password)
    if (isMatched === true) {
      const payload = {username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_CODE')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
const authenticateToken = async (request, response, next) => {
  let jwtToken = ''
  const authenticate = request.headers['authorization']
  if (authenticate !== undefined) {
    jwtToken = authenticate.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid access token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_CODE', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
        request.username = payload.username
      }
    })
  }
}
app.get('/states/', authenticateToken, async (request, response) => {
  const stateQuery = `
        SELECT * FROM state `
  const stateArray = await db.all(stateQuery)
  const ans = state => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    }
  }
  response.send(stateArray.map(state => ans(state)))
})
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const stateQuery = `
  SELECT * FROM state WHERE state_id=${stateId}`
  const stateArray = await db.get(stateQuery)
  response.send({
    stateId: stateArray.state_id,
    stateName: stateArray.state_name,
    population: stateArray.population,
  })
})
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const districtQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths} 

  )`
  await db.run(districtQuery)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtQuery = `
  SELECT * FROM district WHERE district_id=${districtId}`
    const districtArray = await db.get(districtQuery)
    response.send({
      districtId: districtArray.district_id,
      districtName: districtArray.district_name,
      stateId: districtArray.state_id,
      cases: districtArray.cases,
      cured: districtArray.cured,
      active: districtArray.active,
      deaths: districtArray.deaths,
    })
  },
)
app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtQuery = `
  DELETE FROM district WHERE district_id=${districtId}`
    await db.run(districtQuery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const districtQuery = `
  UPDATE district 
  SET
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths} WHERE district_id=${districtId}`
    await db.run(districtQuery)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const stateQuery = `
  SELECT SUM(district.cases) as totalCases, SUM(district.cured) as totalCured,
  SUM(district.active) as totalActive,SUM(district.deaths) as totalDeaths FROM district inner join state ON
  district.state_id=state.state_id WHERE state.state_id=${stateId} GROUP BY district.state_id`
    const stateArray = await db.get(stateQuery)
    response.send({
      totalCases,
      totalCured,
      totalActive,
      totalDeaths,
    })
  },
)
module.exports = app
