const axios = require('axios')

async function testSaveProject() {
  try {
    const response = await axios.post('http://localhost:5173/api/consumption/save-project', {
      projectCode: 'P008',
      projectName: '测试项目8',
      projectType: 'software',
      status: 'ongoing',
      contractAmount: 8000000,
      preSaleRatio: 0.1,
      taxRate: 0.06,
      externalLaborCost: 800000,
      externalSoftwareCost: 400000,
      otherCost: 160000,
      currentManpowerCost: 0
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer *********************************************************************************************************************************************************************.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoic21pdGgiLCJyb2xlIjoicG0iLCJpYXQiOjE3NzU4MDg3OTUsImV4cCI6MTc3ODQwMDc5NX0.X9c9f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f'
      }
    })

    console.log('保存项目信息的响应:', response.data)

    // 测试查询项目信息
    const queryResponse = await axios.get('http://localhost:5173/api/consumption/project/P008', {
      headers: {
        'Authorization': 'Bearer *********************************************************************************************************************************************************************.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoic21pdGgiLCJyb2xlIjoicG0iLCJpYXQiOjE3NzU4MDg3OTUsImV4cCI6MTc3ODQwMDc5NX0.X9c9f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f'
      }
    })

    console.log('查询项目信息的响应:', queryResponse.data)

  } catch (error) {
    console.error('测试失败:', error)
  }
}

testSaveProject()