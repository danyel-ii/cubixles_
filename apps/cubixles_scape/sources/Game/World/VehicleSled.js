import * as THREE from 'three/webgpu'
import { color, float, mix, normalLocal, positionLocal, step } from 'three/tsl'

export function createCubeSledVehicle()
{
    const root = new THREE.Group()

    const chassis = new THREE.Group()
    chassis.name = 'chassis'
    root.add(chassis)

    const cubeBaseColor = color('#1ee7ff')
    const cubeGlowColor = color('#2ff3ff')
    const cubeMagenta = color('#ff2eb4')
    const lineThickness = float(0.06)
    const frontFace = step(float(0.9), normalLocal.z)
    const lineBand = step(lineThickness, positionLocal.y.abs()).oneMinus()
    const lineMask = frontFace.mul(lineBand)
    const cubeColorNode = mix(cubeBaseColor, cubeMagenta, lineMask)
    const cubeEmissiveNode = mix(cubeGlowColor, cubeMagenta, lineMask).mul(float(1.6))

    const cubeGlowMat = new THREE.MeshStandardNodeMaterial()
    cubeGlowMat.colorNode = cubeColorNode
    cubeGlowMat.emissiveNode = cubeEmissiveNode
    cubeGlowMat.roughness = 0.25
    cubeGlowMat.metalness = 0.15
    cubeGlowMat.name = 'cubeGlow'
    cubeGlowMat.userData.prevent = true

    const cubeGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8)
    const cube = new THREE.Mesh(cubeGeometry, cubeGlowMat)
    cube.name = 'bodyPainted'
    cube.position.set(0, 1.8, 0)
    cube.userData.preventPaints = true
    chassis.add(cube)

    const cubeEdgeMat = new THREE.LineBasicMaterial({ color: 0x0b0b10, transparent: true, opacity: 0.9 })
    const cubeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeometry), cubeEdgeMat)
    cubeEdges.name = 'bodyEdges'
    cubeEdges.scale.setScalar(1.01)
    cube.add(cubeEdges)

    const skinGeometry = new THREE.BoxGeometry(1.86, 1.86, 1.86)
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.95 })
    skinMaterial.userData.prevent = true
    const skinCube = new THREE.Mesh(skinGeometry, skinMaterial)
    skinCube.name = 'skinCube'
    skinCube.position.copy(cube.position)
    skinCube.visible = false
    skinCube.userData.preventPaints = true
    chassis.add(skinCube)

    const sledMat = new THREE.MeshStandardMaterial({ color: 0x3a2a34, roughness: 0.8, metalness: 0.1, name: 'sledBase' })
    const sledBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.2), sledMat)
    sledBase.position.set(0, 0.6, 0)
    chassis.add(sledBase)

    const runnerGeo = new THREE.BoxGeometry(3.6, 0.2, 0.3)
    const runnerLeft = new THREE.Mesh(runnerGeo, sledMat)
    runnerLeft.position.set(0, 0.25, -0.85)
    chassis.add(runnerLeft)
    const runnerRight = new THREE.Mesh(runnerGeo, sledMat)
    runnerRight.position.set(0, 0.25, 0.85)
    chassis.add(runnerRight)

    const frontBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 12), sledMat)
    frontBar.rotation.z = Math.PI / 2
    frontBar.position.set(1.3, 0.8, 0)
    chassis.add(frontBar)

    const ethGroup = new THREE.Group()
    ethGroup.name = 'ethereum'
    ethGroup.position.set(2.2, 0.6, 0)
    ethGroup.scale.set(2.06, 2.06, 2.06)

    const ethTopMat = new THREE.MeshStandardMaterial({
        color: 0xaeb3ff,
        roughness: 0.35,
        metalness: 0.2,
        emissive: 0x6f7dff,
        emissiveIntensity: 0.4,
        name: 'ethTop'
    })
    const ethBottomMat = new THREE.MeshStandardMaterial({
        color: 0x6a6d9b,
        roughness: 0.4,
        metalness: 0.25,
        emissive: 0x3c4180,
        emissiveIntensity: 0.35,
        name: 'ethBottom'
    })

    const topGeo = new THREE.ConeGeometry(0.28, 0.5, 4)
    const top = new THREE.Mesh(topGeo, ethTopMat)
    top.position.set(0, 0.4, 0)
    top.rotation.y = Math.PI / 4
    ethGroup.add(top)

    const bottomGeo = new THREE.ConeGeometry(0.28, 0.6, 4)
    const bottom = new THREE.Mesh(bottomGeo, ethBottomMat)
    bottom.position.set(0, 0.05, 0)
    bottom.rotation.y = Math.PI / 4
    bottom.rotation.x = Math.PI
    ethGroup.add(bottom)

    const core = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 4), ethTopMat)
    core.position.set(0, 0.15, 0)
    core.rotation.y = Math.PI / 4
    ethGroup.add(core)

    chassis.add(ethGroup)

    const harnessMat = new THREE.MeshStandardMaterial({ color: 0xd25353, roughness: 0.4, metalness: 0.1, name: 'harness' })
    const harness = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), harnessMat)
    harness.rotation.z = Math.PI / 2
    harness.position.set(1.8, 0.8, 0)
    chassis.add(harness)

    const blinkerMat = new THREE.MeshStandardMaterial({ color: 0xfff1eb, emissive: 0xff5c7a, emissiveIntensity: 0.8, name: 'blinkers' })
    const blinkerLeft = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), blinkerMat)
    blinkerLeft.name = 'blinkerLeft'
    blinkerLeft.position.set(-1.6, 0.6, -0.7)
    chassis.add(blinkerLeft)

    const blinkerRight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), blinkerMat)
    blinkerRight.name = 'blinkerRight'
    blinkerRight.position.set(-1.6, 0.6, 0.7)
    chassis.add(blinkerRight)

    const backLights = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), blinkerMat)
    backLights.name = 'backLights'
    backLights.position.set(-1.7, 0.5, 0)
    chassis.add(backLights)

    const stopLights = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), blinkerMat)
    stopLights.name = 'stopLights'
    stopLights.position.set(-1.65, 0.42, 0)
    chassis.add(stopLights)

    const antenna = new THREE.Group()
    antenna.name = 'antenna'
    const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), harnessMat)
    antennaRod.position.set(0, 0.7, 0)
    antenna.add(antennaRod)
    const antennaRef = new THREE.Object3D()
    antennaRef.name = 'antennaHeadReference'
    antennaRef.position.set(0, 1.4, 0)
    antenna.add(antennaRef)
    antenna.position.set(-0.4, 2.2, -0.8)
    chassis.add(antenna)

    const antennaHead = new THREE.Group()
    antennaHead.name = 'antennaHead'
    const headAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 10), harnessMat)
    headAxle.rotation.x = Math.PI / 2
    antennaHead.add(headAxle)
    const headOrb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), blinkerMat)
    headOrb.position.set(0, 0.18, 0)
    antennaHead.add(headOrb)
    root.add(antennaHead)

    const wheelContainer = new THREE.Group()
    wheelContainer.name = 'wheelContainer'
    wheelContainer.visible = false
    const wheelSuspension = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), sledMat)
    wheelSuspension.name = 'wheelSuspension'
    wheelSuspension.position.set(0, 0.3, 0)
    wheelContainer.add(wheelSuspension)
    const wheelCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), sledMat)
    wheelCylinder.name = 'wheelCylinder'
    wheelCylinder.rotation.x = Math.PI / 2
    wheelCylinder.position.set(0, 0, 0)
    wheelContainer.add(wheelCylinder)
    const wheelPainted = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), cubeGlowMat)
    wheelPainted.name = 'wheelPainted'
    wheelPainted.rotation.x = Math.PI / 2
    wheelPainted.position.set(0, 0, 0)
    wheelContainer.add(wheelPainted)
    root.add(wheelContainer)

    return root
}
